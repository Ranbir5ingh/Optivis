export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
}
