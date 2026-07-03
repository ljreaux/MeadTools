import Link from "next/link";
import { useTranslation, Trans } from "react-i18next";

export default function FinalTutorialComponent() {
  const { t } = useTranslation();

  return (
    <Trans
      i18nKey="tutorial.finalStep"
      values={{
        backText: t("tutorial.backToBuilder"),
      }}
      components={{
        backLink: <Link href="/" className="text-blue-500 underline"></Link>,
        tutorialLink: (
          <a
            href="https://meadtools.com/tutorial"
            className="text-blue-500 underline"
          ></a>
        ),
      }}
    />
  );
}
