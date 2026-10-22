import { Learn } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';

/** One point of a drawer: a short label and one or more short lines under it. */
export interface LearnItem {
  term: string;
  /** One line shows as plain text; two or more show as a bullet list. */
  points: string[];
}

export interface LearnMoreProps {
  title: string;
  items: LearnItem[];
  testId: string;
  className?: string;
}

/** The app's "Learn" link: a drawer of labelled points, labelled in the active language. */
export function LearnMore({ title, items, testId, className }: LearnMoreProps) {
  const { t } = useCopy();
  return (
    <Learn
      title={title}
      label={t('learn.open')}
      closeLabel={t('learn.close')}
      testId={testId}
      className={className}
    >
      <dl className="m-0 flex flex-col gap-4">
        {items.map(({ term, points }) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="font-semibold text-fg">{term}</dt>
            <dd className="m-0">
              {points.length === 1 ? (
                points[0]
              ) : (
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                  {points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Learn>
  );
}
