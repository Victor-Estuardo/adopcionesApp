import React from "react";

type InputWithIconProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className"
>;

export default function ({ ...props }: InputWithIconProps) {
  return (
    <input
      {...props}
      className={`w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500`}
    />
  );
}
