import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <SetPasswordForm
      heading="Choose a new password"
      ctaLabel="Save password & continue"
      invalidLinkMessage="This reset link is invalid or has expired. Request a new one."
    />
  );
}
