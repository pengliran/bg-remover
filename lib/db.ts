// D1 数据库操作封装
// 在 Cloudflare Pages Edge Runtime 中，通过 Cloudflare REST API 操作 D1

interface D1User {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  plan: string;
  credits: number;
  subscription_expires: string | null;
  total_usage: number;
  last_usage_date: string | null;
  created_at: string;
  last_login: string;
}

// Cloudflare Pages 中通过 process.env 不可直接获取 D1 binding
// 需要用 getRequestContext，但 direct upload 下 process.env 不包含 D1
// 所以我们用 Cloudflare REST API 来操作 D1

const CF_ACCOUNT_ID = "ef6c1ace96fde4e570a0ebc1730f6f6d";
const CF_DATABASE_ID = "af77710a-ab2d-41f2-9347-4fd91912e968";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";

// 通过 HTTP API 执行 D1 查询（Edge Runtime 下无法直接访问 D1 binding）
async function d1Query(sql: string, params?: (string | number | null)[]): Promise<D1Result> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params: params || [] }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`D1 query failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.success || data.errors?.length > 0) {
    throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  }

  return data.result[0] as D1Result;
}

interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: {
    changed_db: boolean;
    changes: number;
    duration: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
    size_after: number;
  };
}

// 创建或更新用户
export async function upsertUser(user: {
  googleId: string;
  email: string;
  name?: string;
  avatar?: string;
}): Promise<D1User> {
  const result = await d1Query(
    `INSERT INTO users (google_id, email, name, avatar, last_login)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(google_id) DO UPDATE SET
       email = excluded.email,
       name = COALESCE(excluded.name, name),
       avatar = COALESCE(excluded.avatar, avatar),
       last_login = datetime('now')`,
    [user.googleId, user.email, user.name || null, user.avatar || null]
  );

  // 返回更新后的用户
  return getUserByGoogleId(user.googleId) as Promise<D1User>;
}

// 通过 Google ID 获取用户
export async function getUserByGoogleId(googleId: string): Promise<D1User | null> {
  const result = await d1Query(
    "SELECT * FROM users WHERE google_id = ?",
    [googleId]
  );

  if (result.results.length === 0) return null;
  return result.results[0] as unknown as D1User;
}

// 通过邮箱获取用户
export async function getUserByEmail(email: string): Promise<D1User | null> {
  const result = await d1Query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (result.results.length === 0) return null;
  return result.results[0] as unknown as D1User;
}

// 更新用户套餐
export async function updateUserPlan(userId: number, plan: string, expiresAt?: string): Promise<void> {
  if (expiresAt) {
    await d1Query(
      "UPDATE users SET plan = ?, subscription_expires = ? WHERE id = ?",
      [plan, expiresAt, userId]
    );
  } else {
    await d1Query(
      "UPDATE users SET plan = ? WHERE id = ?",
      [plan, userId]
    );
  }
}

// 增加用户积分
export async function addUserCredits(userId: number, credits: number): Promise<void> {
  await d1Query(
    "UPDATE users SET credits = credits + ? WHERE id = ?",
    [credits, userId]
  );
}

// 扣减用户积分，返回实际扣减数量
export async function deductUserCredits(userId: number, amount: number): Promise<number> {
  const user = await getUserById(userId);
  if (!user) return 0;

  const actualDeduct = Math.min(user.credits, amount);
  await d1Query(
    "UPDATE users SET credits = credits - ? WHERE id = ?",
    [actualDeduct, userId]
  );
  return actualDeduct;
}

// 通过 ID 获取用户
export async function getUserById(userId: number): Promise<D1User | null> {
  const result = await d1Query(
    "SELECT * FROM users WHERE id = ?",
    [userId]
  );

  if (result.results.length === 0) return null;
  return result.results[0] as unknown as D1User;
}

// 记录每日用量（原子递增）
export async function incrementUsage(userId: number, date: string): Promise<number> {
  // 先检查是否有过期套餐
  const user = await getUserById(userId);
  if (user && user.subscription_expires) {
    const now = new Date().toISOString();
    if (now > user.subscription_expires) {
      // 套餐已过期，重置为 free
      await d1Query(
        "UPDATE users SET plan = 'free', subscription_expires = NULL WHERE id = ?",
        [userId]
      );
    }
  }

  const today = date || new Date().toISOString().slice(0, 10);

  // 使用 UPSERT 确保记录存在
  await d1Query(
    `INSERT INTO usage_logs (user_id, date, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1`,
    [userId, today]
  );

  // 查询当前用量
  const result = await d1Query(
    "SELECT count FROM usage_logs WHERE user_id = ? AND date = ?",
    [userId, today]
  );

  return result.results.length > 0 ? (result.results[0].count as number) : 0;
}

// 获取用户今日用量
export async function getDailyUsage(userId: number, date?: string): Promise<number> {
  const today = date || new Date().toISOString().slice(0, 10);
  const result = await d1Query(
    "SELECT count FROM usage_logs WHERE user_id = ? AND date = ?",
    [userId, today]
  );

  return result.results.length > 0 ? (result.results[0].count as number) : 0;
}

// 获取用户的实际可用套餐（处理过期）
export async function getEffectivePlan(user: D1User): Promise<{
  plan: string;
  limit: number;
  hasExpired: boolean;
}> {
  const PLANS: Record<string, number> = {
    free: 10,
    basic: 100,
    pro: 500,
    unlimited: Infinity,
  };

  let plan = user.plan || "free";
  let hasExpired = false;

  // 检查订阅是否过期
  if (user.subscription_expires && plan !== "free") {
    const now = new Date();
    const expires = new Date(user.subscription_expires);
    if (now > expires) {
      plan = "free";
      hasExpired = true;
    }
  }

  return {
    plan,
    limit: PLANS[plan] || 10,
    hasExpired,
  };
}

// 获取用量限额（综合套餐 + 积分）
export async function getUsageLimit(user: D1User): Promise<{
  plan: string;
  subscriptionLimit: number;
  credits: number;
  totalLimit: number;
}> {
  const { plan, limit } = await getEffectivePlan(user);
  const credits = user.credits || 0;

  return {
    plan,
    subscriptionLimit: limit,
    credits,
    totalLimit: limit === Infinity ? Infinity : limit + credits,
  };
}
