export type JwtPayload = {
  sub: string;
  roleCode: string;
  departmentId: string | null;
};

export type RequestUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  roleCode: string;
  roleName: string;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  isDepartmentAdmin: boolean;
};
