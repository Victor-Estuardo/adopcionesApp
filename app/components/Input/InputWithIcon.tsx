import React from "react";

type InputWithIconProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  Icon: React.ElementType;
  iconPosition?: "left" | "right";
  iconClassName?: string;
  onIconClick?: () => void;
};

export default function InputWithIcon({
  Icon,
  iconPosition = "left",
  iconClassName = "",
  onIconClick,
  ...props
}: InputWithIconProps) {
  const iconCommonClasses =
    "absolute top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer";
  const iconPositionClass = iconPosition === "left" ? "left-3" : "right-3";

  return (
    <div className="relative w-full">
      <input
        {...props}
        className={`w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500 ${
          iconPosition === "left" ? "pl-10" : "pr-10"
        }`}
      />
      <Icon
        onClick={onIconClick}
        className={`${iconCommonClasses} ${iconPositionClass} ${iconClassName}`}
        size={20}
      />
    </div>
  );
}
