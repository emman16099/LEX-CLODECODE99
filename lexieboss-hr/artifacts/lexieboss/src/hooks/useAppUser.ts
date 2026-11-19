import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

export function useAppUser(enabled = true) {
  const { data, isLoading, error } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled },
  });
  return {
    appUser: data ?? null,
    isLoading: enabled ? isLoading : false,
    isAdmin: data?.role === "admin",
    isEmployee: data?.role === "employee",
    error,
  };
}
