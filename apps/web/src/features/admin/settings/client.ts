import type {
  SettingsGroupDto,
  SiteSettingBulkUpdateInput,
  SiteSettingRow,
} from '@portfolio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mutate, request } from '@/lib/api/adminClient';

const QUERY_KEY = ['admin-settings'];
const BASE_PATH = '/api/v1/admin/settings';

export function useSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<SettingsGroupDto[]>(BASE_PATH),
  });
}

export function useBulkUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: SiteSettingBulkUpdateInput) =>
      mutate<SiteSettingRow[]>(BASE_PATH, { method: 'PATCH', body: entries }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
