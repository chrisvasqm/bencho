import { Learn } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';

export interface LearnMoreProps {
  title: string;
  /** One string per paragraph. */
  paragraphs: string[];
  testId: string;
  className?: string;
}

/** The app's "Learn" link: a drawer of short paragraphs, labelled in the active language. */
export function LearnMore({ title, paragraphs, testId, className }: LearnMoreProps) {
  const { t } = useCopy();
  return (
    <Learn
      title={title}
      label={t('learn.open')}
      closeLabel={t('learn.close')}
      testId={testId}
      className={className}
    >
      {paragraphs.map((text, index) => (
        // Fixed order per drawer, and two paragraphs may share the same text.
        <p key={index} className="m-0">
          {text}
        </p>
      ))}
    </Learn>
  );
}
