import { SignIn } from "@clerk/react-router";

export function SignInPage() {
  return (
    <div className="flex justify-center items-center h-screen">
      <SignIn withSignUp />
    </div>
  );
}
