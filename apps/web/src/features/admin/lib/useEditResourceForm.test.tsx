import { renderHook, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEditResourceForm } from './useEditResourceForm';

interface Row {
  id: number;
  name: string;
}
interface Values {
  name: string;
}

function fakeQuery(data: Row | undefined): UseQueryResult<Row> {
  return { data, isPending: data === undefined } as UseQueryResult<Row>;
}

describe('useEditResourceForm', () => {
  it('leaves the form at its initial defaults while the query has no data yet', () => {
    const { result } = renderHook(() => {
      const methods = useForm<Values>({ defaultValues: { name: '' } });
      useEditResourceForm({
        itemQuery: fakeQuery(undefined),
        methods,
        toFormValues: (row: Row) => ({ name: row.name }),
      });
      return methods;
    });
    expect(result.current.getValues('name')).toBe('');
  });

  it('resets the form to the fetched row once the query resolves', async () => {
    const { result, rerender } = renderHook(
      ({ row }: { row: Row | undefined }) => {
        const methods = useForm<Values>({ defaultValues: { name: '' } });
        useEditResourceForm({
          itemQuery: fakeQuery(row),
          methods,
          toFormValues: (r: Row) => ({ name: r.name }),
        });
        return methods;
      },
      { initialProps: { row: undefined as Row | undefined } },
    );

    rerender({ row: { id: 1, name: 'React' } });
    await waitFor(() => expect(result.current.getValues('name')).toBe('React'));
  });
});
