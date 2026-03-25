import React, { useState, useMemo } from 'react';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  placeholder?: string;
  required?: boolean;
  validation?: {
    required?: string;
    pattern?: { value: RegExp; message: string };
    minLength?: { value: number; message: string };
    maxLength?: { value: number; message: string };
    min?: { value: number; message: string };
    max?: { value: number; message: string };
    custom?: (value: any) => string | null;
  };
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
}

interface FormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => void;
  className?: string;
  submitButtonText?: string;
  initialValues?: Record<string, any>;
}

export const Form: React.FC<FormProps> = ({
  fields,
  onSubmit,
  className = '',
  submitButtonText = 'Enviar',
  initialValues = {},
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: FormField, value: any): string | null => {
    if (field.validation) {
      if (field.validation.required && (!value || value === '')) {
        return field.validation.required;
      }

      if (field.validation.pattern && value && !field.validation.pattern.value.test(value)) {
        return field.validation.pattern.message;
      }

      if (field.validation.minLength && value && value.length < field.validation.minLength.value) {
        return field.validation.minLength.message;
      }

      if (field.validation.maxLength && value && value.length > field.validation.maxLength.value) {
        return field.validation.maxLength.message;
      }

      if (field.validation.min && value && Number(value) < field.validation.min.value) {
        return field.validation.min.message;
      }

      if (field.validation.max && value && Number(value) > field.validation.max.value) {
        return field.validation.max.message;
      }

      if (field.validation.custom) {
        return field.validation.custom(value);
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
        isValid = false;
      }
    });

    return isValid;
  };

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // Validar campo quando o usuário interage
    if (!touched[name]) {
      setTouched(prev => ({ ...prev, [name]: true }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const errors = useMemo(() => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });
    return newErrors;
  }, [formData, fields]);

  const renderField = (field: FormField) => {
    const hasError = errors[field.name] && touched[field.name];
    const errorClass = hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name} className="mb-4">
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={e => handleInputChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              className={`w-full px-3 py-2 border ${errorClass} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`}
              rows={3}
            />
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="mb-4">
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              id={field.name}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={e => handleInputChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              className={`w-full px-3 py-2 border ${errorClass} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`}
            >
              <option value="">{field.placeholder || 'Selecione uma opção'}</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="mb-4">
            <div className="flex items-center">
              <input
                id={field.name}
                name={field.name}
                type="checkbox"
                checked={formData[field.name] || false}
                onChange={e => handleInputChange(field.name, e.target.checked)}
                onBlur={() => handleBlur(field.name)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={field.name} className="ml-2 block text-sm text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map(option => (
                <div key={option.value} className="flex items-center">
                  <input
                    id={`${field.name}-${option.value}`}
                    name={field.name}
                    type="radio"
                    value={option.value}
                    checked={formData[field.name] === option.value}
                    onChange={e => handleInputChange(field.name, e.target.value)}
                    onBlur={() => handleBlur(field.name)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor={`${field.name}-${option.value}`}
                    className="ml-2 block text-sm text-gray-700"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      default:
        return (
          <div key={field.name} className="mb-4">
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={e => handleInputChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              className={`w-full px-3 py-2 border ${errorClass} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`}
            />
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {fields.map(field => renderField(field))}

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitButtonText}
        </button>
      </div>
    </form>
  );
};
