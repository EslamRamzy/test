import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/ApiError';
import { applyApiErrors } from './applyApiErrors';

interface Values {
  title: string;
  slug: string;
}

function setup(defaultValues: Values) {
  return renderHook(() => {
    const methods = useForm<Values>({ defaultValues });
    // react-hook-form's `formState` is a Proxy that only re-renders
    // subscribers to properties actually READ during render — touching
    // `.errors` here is what makes `result.current` reflect a later
    // `setError` call at all (a real gotcha with `renderHook`, not
    // something this test's assertions would otherwise need).
    void methods.formState.errors;
    return methods;
  });
}

describe('applyApiErrors', () => {
  it("maps a VALIDATION_ERROR's details onto matching form fields", () => {
    const { result } = setup({ title: '', slug: '' });
    const error = new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', [
      { field: 'slug', message: 'Must be lowercase words separated by single hyphens' },
    ]);

    // `setError` schedules a state update — `formState.errors` on the
    // pre-update `result.current` snapshot would still be stale otherwise.
    let applied = false;
    act(() => {
      applied = applyApiErrors(result.current, error);
    });

    expect(applied).toBe(true);
    expect(result.current.formState.errors.slug?.message).toBe(
      'Must be lowercase words separated by single hyphens',
    );
  });

  it('ignores a detail whose field is not part of the form', () => {
    const { result } = setup({ title: '', slug: '' });
    const error = new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', [
      { field: 'authorId', message: 'Unknown field' },
    ]);

    let applied = false;
    act(() => {
      applied = applyApiErrors(result.current, error);
    });

    expect(applied).toBe(false);
    expect(Object.keys(result.current.formState.errors)).toHaveLength(0);
  });

  it('returns false for a non-ApiError, or an ApiError with no details', () => {
    const { result } = setup({ title: '', slug: '' });
    expect(applyApiErrors(result.current, new Error('boom'))).toBe(false);
    expect(applyApiErrors(result.current, new ApiError(500, 'Server error'))).toBe(false);
  });
});
