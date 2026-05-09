import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign up | Admin"
        description="Create an account for the admin dashboard."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
