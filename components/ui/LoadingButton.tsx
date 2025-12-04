import { Button } from "./button";
import { Spinner } from "./spinner";

interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  loading: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  loadingText,
  children,
  ...props
}) => {
  return (
    <Button {...props} disabled={loading || props.disabled}>
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner className="h-4 w-4" />
          {loadingText && <span>{loadingText}</span>}
        </span>
      ) : (
        children
      )}
    </Button>
  );
};
