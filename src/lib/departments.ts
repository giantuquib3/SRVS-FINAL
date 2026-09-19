export interface DepartmentInfo {
  id: string; // Text code e.g. 'CPE'
  code: string;
  name: string;
  description: string;
}

export const DEPARTMENTS: DepartmentInfo[] = [
  {
    id: 'CPE',
    code: 'CPE',
    name: 'Computer Engineering',
    description: 'Department of Computer Engineering',
  },
  {
    id: 'EE',
    code: 'EE',
    name: 'Electrical Engineering',
    description: 'Department of Electrical Engineering',
  },
  {
    id: 'CE',
    code: 'CE',
    name: 'Civil Engineering',
    description: 'Department of Civil Engineering',
  },
  {
    id: 'ECE',
    code: 'ECE',
    name: 'Electronics Engineering',
    description: 'Department of Electronics Engineering',
  },
  {
    id: 'IE',
    code: 'IE',
    name: 'Industrial Engineering',
    description: 'Department of Industrial Engineering',
  },
  {
    id: 'ME',
    code: 'ME',
    name: 'Mechanical Engineering',
    description: 'Department of Mechanical Engineering',
  },
];

export const VALID_DEPARTMENT_CODES = ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] as const;
export type DepartmentCode = typeof VALID_DEPARTMENT_CODES[number];

export function isValidDepartmentCode(code?: string | null): code is DepartmentCode {
  if (!code) return false;
  return VALID_DEPARTMENT_CODES.includes(code.trim().toUpperCase() as DepartmentCode);
}

export function getDepartmentName(code?: string | null): string {
  if (!code) return 'General Engineering';
  const match = DEPARTMENTS.find((d) => d.code.toUpperCase() === code.trim().toUpperCase());
  return match ? match.name : code;
}

export function getDepartmentInfo(code?: string | null): DepartmentInfo | undefined {
  if (!code) return undefined;
  return DEPARTMENTS.find((d) => d.code.toUpperCase() === code.trim().toUpperCase());
}
