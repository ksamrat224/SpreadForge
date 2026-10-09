const TOKEN_COOKIE = "spreadforge_private_er";
const TOKEN_MAX_AGE_SECONDS = 60 * 60;

type PrivateErServerConfig = {
  privateErUrl: string;
  challengeUrl: string;
  loginUrl: string;
  transactionRelayUrl: string;
  /** Payments API tokens are not generic TEE-RPC credentials by default. */
  genericRpcAuthMode: "none" | "payment-bearer";
  authorizationHeader: string;
  authorizationPrefix: string;
};

export function getPrivateErServerConfig(): PrivateErServerConfig | null {
  const privateErUrl = validUrl(process.env.MAGICBLOCK_PRIVATE_ER_URL);
  const challengeUrl = validUrl(process.env.MAGICBLOCK_PRIVATE_ER_AUTH_CHALLENGE_URL);
  const loginUrl = validUrl(process.env.MAGICBLOCK_PRIVATE_ER_AUTH_LOGIN_URL);
  if (!privateErUrl || !challengeUrl || !loginUrl) return null;
  const transactionRelayUrl = validUrl(process.env.MAGICBLOCK_PRIVATE_ER_TRANSACTION_RELAY_URL)
    ?? new URL("/v1/transaction/send", loginUrl).toString();
  const genericRpcAuthMode = process.env.MAGICBLOCK_PRIVATE_ER_GENERIC_RPC_AUTH ?? "none";
  if (genericRpcAuthMode !== "none" && genericRpcAuthMode !== "payment-bearer") {
    throw new Error("MAGICBLOCK_PRIVATE_ER_GENERIC_RPC_AUTH must be 'none' or 'payment-bearer'.");
  }
  const authorizationHeader = process.env.MAGICBLOCK_PRIVATE_ER_AUTH_HEADER ?? "Authorization";
  const authorizationPrefix = process.env.MAGICBLOCK_PRIVATE_ER_AUTH_PREFIX ?? "Bearer ";
  if (!/^[A-Za-z0-9-]+$/.test(authorizationHeader)) {
    throw new Error("MAGICBLOCK_PRIVATE_ER_AUTH_HEADER must be a valid HTTP header name.");
  }
  if (!/^[\x20-\x7e]*$/.test(authorizationPrefix)) {
    throw new Error("MAGICBLOCK_PRIVATE_ER_AUTH_PREFIX must contain printable ASCII characters only.");
  }
  return {
    privateErUrl,
    challengeUrl,
    loginUrl,
    transactionRelayUrl,
    genericRpcAuthMode,
    authorizationHeader,
    authorizationPrefix,
  };
}

export function getPrivateErTokenCookieName() {
  return TOKEN_COOKIE;
}

export function getPrivateErTokenMaxAge() {
  return TOKEN_MAX_AGE_SECONDS;
}

function validUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
