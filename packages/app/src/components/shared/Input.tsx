/**
 * Reusable Input Component
 * Tailwind v4 - no @apply directives
 */

import React from 'react';

export type InputProps = {
  id?: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'placeholder' | 'disabled' | 'required' | 'autoComplete' | 'autoFocus' | 'className'>;

export function Input({
  id,
  name,
  type = 'text',
  value,
  defaultValue,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  required = false,
  autoComplete,
  autoFocus = false,
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  ...rest
}: InputProps) {
  const inputId = id || name;
  
  const baseStyles = 'px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors';
  const normalStyles = 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
  const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500';
  const widthStyle = fullWidth ? 'w-full' : '';
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={type === 'password' ? (autoComplete ?? 'off') : autoComplete}
        autoFocus={autoFocus}
        className={`${baseStyles} ${error ? errorStyles : normalStyles} ${widthStyle} ${className}`}
        {...(type === 'password' ? { 'data-1p-ignore': true, 'data-lpignore': 'true' } : {})}
        {...rest}
      />
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

