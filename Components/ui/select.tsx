import {
  forwardRef,
  type SelectHTMLAttributes,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type OptionHTMLAttributes,
} from 'react';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const SelectValue = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ children, ...props }, ref) => {
  return <span ref={ref} {...props}>{children}</span>;
});
SelectValue.displayName = 'SelectValue';

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => {
    return <button ref={ref} {...props}>{children}</button>
});
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => {
    return <div ref={ref} {...props}>{children}</div>;
});
SelectContent.displayName = 'SelectContent';

export const SelectItem = forwardRef<
  HTMLOptionElement,
  OptionHTMLAttributes<HTMLOptionElement>
>(({ children, ...props }, ref) => {
    return <option ref={ref} {...props}>{children}</option>
});
SelectItem.displayName = 'SelectItem'; 