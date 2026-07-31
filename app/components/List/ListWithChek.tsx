import { IoCheckmark } from "react-icons/io5";

interface ListWithCheckProps {
  ulId: string;
  list: { key?: string; value: string; label: string }[];
  onClickLi?: (value: number | string) => void;
  selections?: string[];
}

export default ({ list, ulId, onClickLi, selections }: ListWithCheckProps) => {
  return (
    <ul id={ulId} className="flex flex-col gap-y-1">
      {list.map((option) => {
        const checked = selections?.includes(option.value);
        return (
          <li key={option.value}>
            <button
              type="button"
              onClick={() => onClickLi?.(option.value)}
              className={`w-full flex items-center gap-x-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                checked
                  ? "bg-blue-meraki/10 text-blue-meraki font-medium"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span
                className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                  checked
                    ? "bg-blue-meraki border-blue-meraki"
                    : "border-gray-300"
                }`}
              >
                {checked && <IoCheckmark className="w-3 h-3 text-white" />}
              </span>
              <span className="capitalize">{option.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
