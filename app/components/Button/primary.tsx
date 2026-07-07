import { IconType } from "react-icons";

type PrimaryButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  Icon?: IconType;
  label: string;
  className?: string;
};

export function PrimaryButton({
  disabled,
  onClick,
  Icon,
  label,
  className,
}: PrimaryButtonProps) {
  return (
    <button
      className={`${
        Icon ? "flex items-center gap-x-2" : ""
      } ${className} bg-medium-turquoise-meraki px-4 py-2 text-white rounded-full text-sm md:text-base disabled:opacity-60 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon />}
      {label}
    </button>
  );
}
