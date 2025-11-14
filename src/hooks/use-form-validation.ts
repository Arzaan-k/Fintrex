// FORM VALIDATION HOOK
// Easy integration of Zod schemas with React forms

import { useState, useCallback } from 'react';
import { z } from 'zod';

interface ValidationState<T> {
  data: Partial<T>;
  errors: Record<string, string>;
  isValidating: boolean;
  isValid: boolean;
}

interface UseFormValidationResult<T> {
  data: Partial<T>;
  errors: Record<string, string>;
  isValidating: boolean;
  isValid: boolean;
  setField: (field: keyof T, value: any) => void;
  setData: (data: Partial<T>) => void;
  validate: () => Promise<boolean>;
  validateField: (field: keyof T) => Promise<boolean>;
  reset: () => void;
  getFieldError: (field: keyof T) => string | undefined;
}

/**
 * Hook for form validation with Zod schemas
 *
 * @param schema - Zod schema to validate against
 * @param initialData - Initial form data
 * @param options - Validation options
 *
 * @example
 * const { data, errors, setField, validate } = useFormValidation(loginSchema, {
 *   email: '',
 *   password: ''
 * });
 *
 * // Update field
 * setField('email', 'user@example.com');
 *
 * // Validate before submit
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   if (await validate()) {
 *     // Submit form
 *   }
 * };
 */
export function useFormValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialData: Partial<T> = {},
  options: {
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
  } = {}
): UseFormValidationResult<T> {
  const [state, setState] = useState<ValidationState<T>>({
    data: initialData,
    errors: {},
    isValidating: false,
    isValid: false,
  });

  /**
   * Validate entire form
   */
  const validate = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isValidating: true }));

    try {
      const result = await schema.safeParseAsync(state.data);

      if (result.success) {
        setState((prev) => ({
          ...prev,
          errors: {},
          isValidating: false,
          isValid: true,
        }));
        return true;
      } else {
        const errors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join('.');
          errors[path] = issue.message;
        });

        setState((prev) => ({
          ...prev,
          errors,
          isValidating: false,
          isValid: false,
        }));
        return false;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isValidating: false,
        isValid: false,
      }));
      return false;
    }
  }, [schema, state.data]);

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    async (field: keyof T): Promise<boolean> => {
      try {
        // Create a schema for just this field
        const fieldSchema = schema.pick({ [field]: true } as any);
        const result = await fieldSchema.safeParseAsync({
          [field]: state.data[field],
        });

        if (result.success) {
          setState((prev) => ({
            ...prev,
            errors: {
              ...prev.errors,
              [field]: undefined,
            },
          }));
          return true;
        } else {
          const error = result.error.issues[0];
          setState((prev) => ({
            ...prev,
            errors: {
              ...prev.errors,
              [field as string]: error.message,
            },
          }));
          return false;
        }
      } catch (error) {
        // If field doesn't exist in schema or can't be validated separately,
        // validate entire form
        return validate();
      }
    },
    [schema, state.data, validate]
  );

  /**
   * Update a single field
   */
  const setField = useCallback(
    (field: keyof T, value: any) => {
      setState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          [field]: value,
        },
      }));

      // Validate field if option is enabled
      if (options.validateOnChange) {
        setTimeout(() => validateField(field), 0);
      }
    },
    [options.validateOnChange, validateField]
  );

  /**
   * Update all form data
   */
  const setData = useCallback(
    (newData: Partial<T>) => {
      setState((prev) => ({
        ...prev,
        data: newData,
      }));

      // Validate all if option is enabled
      if (options.validateOnChange) {
        setTimeout(() => validate(), 0);
      }
    },
    [options.validateOnChange, validate]
  );

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setState({
      data: initialData,
      errors: {},
      isValidating: false,
      isValid: false,
    });
  }, [initialData]);

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback(
    (field: keyof T): string | undefined => {
      return state.errors[field as string];
    },
    [state.errors]
  );

  return {
    data: state.data,
    errors: state.errors,
    isValidating: state.isValidating,
    isValid: state.isValid,
    setField,
    setData,
    validate,
    validateField,
    reset,
    getFieldError,
  };
}

/**
 * Helper hook for simple field validation
 */
export function useFieldValidation<T>(
  schema: z.ZodSchema<T>,
  initialValue: T
) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);

    try {
      await schema.parseAsync(value);
      setError(undefined);
      setIsValidating(false);
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      }
      setIsValidating(false);
      return false;
    }
  }, [schema, value]);

  const onChange = useCallback((newValue: T) => {
    setValue(newValue);
    setError(undefined);
  }, []);

  return {
    value,
    error,
    isValidating,
    onChange,
    validate,
    setValue,
    setError,
  };
}
