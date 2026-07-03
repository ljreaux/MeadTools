import initTranslations from "@/lib/i18n";

async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ["default", "YeastTable"]);

  const sources = [
    { label: t("about.sourcesList.one") },
    {
      label: t("about.sourcesList.two.label"),
      links: [
        {
          text: t("about.sourcesList.two.linkText"),
          href: "https://www.homebrewersassociation.org/attachments/0000/2497/Math_in_Mash_SummerZym95.pdf"
        },
        {
          textBefore: t("about.sourcesList.two.two.text"),
          text: t("about.sourcesList.two.two.linkText"),
          href: "https://docs.google.com/document/d/e/2PACX-1vR89nFNsnMTrIpykZpciqHeRXpO6ysy8MmlBczpLv0ziBxkQ0Qn2B3EiFH7vvNwODOjMJmOvZMqabtj/pub"
        }
      ]
    },
    {
      label: t("about.sourcesList.three.label"),
      links: [
        {
          text: t("about.sourcesList.three.one.linkText"),
          href: "https://scottlabsltd.com/content/files/documents/sll/handbooks/scott%20canada%202023%20handbook.pdf"
        },
        {
          text: t("about.sourcesList.three.two.linkText"),
          href: "https://help.mangrovejacks.com/hc/en-us/article_attachments/13551379984785"
        },
        {
          text: t("about.sourcesList.three.three.linkText"),
          href: "https://www.piwine.com/media/pdf/yeast-selection-chart.pdf"
        }
      ]
    },
    {
      label: t("about.sourcesList.four.label"),
      links: [
        {
          text: t("about.sourcesList.four.one.linkText"),
          href: "https://docs.google.com/document/d/11pW-dC91OupCYKX-zld73ckg9ximXwxbmpLFOqv6JEk/edit"
        }
      ]
    },
    {
      label: t("about.sourcesList.five.label"),
      links: [
        {
          text: t("about.sourcesList.five.one.linkText"),
          href: "https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening"
        }
      ]
    },
    {
      label: t("about.sourcesList.six.label"),
      links: [
        {
          text: t("about.sourcesList.six.one.linkText"),
          href: "https://www.homebrewtalk.com/threads/temp-correction-formula-for-hydrometer.10684/"
        }
      ]
    },
    {
      label: t("about.sourcesList.seven.label"),
      links: [
        {
          text: t("about.sourcesList.seven.one.linkText"),
          href: "https://www.homebrewersassociation.org/zymurgy-magazine/jul-aug-2017/"
        }
      ]
    },
    {
      label: t("about.sourcesList.eight.label"),
      links: [
        {
          text: t("about.sourcesList.eight.one.linkText"),
          href: "/woodlandbrew-abv-without-og"
        }
      ]
    },
    {
      label: t("about.sourcesList.nine.label"),
      links: [
        {
          text: t("about.sourcesList.nine.one.linkText"),
          href: "https://gotmead.com/blog/the-mead-calculator/"
        }
      ]
    },
    { label: t("about.sourcesList.ten.label") }
  ];

  return (
    <section className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1200px]">
        <h1 className="sm:text-3xl text-xl text-center">{t("about.label")} </h1>
        <article className="sm:px-12 px-4">
          {[
            t("about.paragraphOne"),
            t("about.paragraphTwo"),
            t("about.paragraphThree")
          ].map((paragraph, idx) => (
            <p key={idx} className="py-4">
              {paragraph}
            </p>
          ))}
          <ol className="flex flex-col gap-4 py-8 list-decimal">
            {sources.map((source, idx) => (
              <li key={idx}>
                {source.label}
                {source.links && (
                  <ul className="ml-8 list-disc">
                    {source.links.map((link, linkIdx) => (
                      <li key={linkIdx}>
                        {link.textBefore && <span>{link.textBefore} </span>}
                        <a
                          className="underline transition-all text-foreground hover:text-secondary"
                          target="_blank"
                          rel="noreferrer"
                          href={link.href}
                        >
                          {link.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <div className="py-12 text-2xl text-center">
            <p>{t("about.sourcesList.thanks.text")}</p>
            <p className="text-4xl py-8">
              {t("about.sourcesList.thanks.thanks")}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

export default About;
