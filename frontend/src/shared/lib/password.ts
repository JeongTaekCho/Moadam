export const passwordRequirement = "8자 이상 · 특수문자 1개 이상";
export function validSignupPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[\p{P}\p{S}]/u.test(password)
  );
}
