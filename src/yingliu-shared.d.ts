declare module '@yingliu/shared' {
  export function getHealth(
    baseUrl: string,
    path: string
  ): Promise<{ data: { service: string; status: string } }>;
}
