import { IoMdCheckmark } from "react-icons/io";

interface ListWithCheckProps {
  ulId: string;
  list: { key?: string; value: string; label: string }[];
  onClickLi?: (value: number | string) => void;
  selections?: string[];
}

export default ({ list, ulId, onClickLi, selections }: ListWithCheckProps) => {
  return (
    <ul id={ulId} className="flex flex-col gap-y-2">
      {list.map((row) => (
        <li key={`${ulId}_${row.label}`}>
          <label className="flex justify-start items-center gap-x-2 cursor-pointer">
            <input
              checked={selections?.includes(row.value)}
              type="checkbox"
              className="hidden peer"
              onChange={() => onClickLi?.(row.value)}
            />
            <span className="w-4 h-4 border-2 border-gray-400 rounded-lg flex items-center justify-center peer-checked:bg-medium-turquoise-meraki peer-checked:border-medium-turquoise-meraki">
              <IoMdCheckmark className="w-2 h-2 text-white" />
            </span>
            <span>{row.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
};
