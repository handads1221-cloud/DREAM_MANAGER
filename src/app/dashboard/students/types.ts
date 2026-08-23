export type Student = {
  id: string;
  full_name: string;
  grade: number;
  class_name: string | null;
  phone: string | null;
  address: string | null;
  school_name: string | null;
  primary_parent_id: string | null;
  note: string | null;
  is_active: boolean;
  photo_path: string | null;
  photo_url?: string | null;
};

export type UpdateStudentResult =
  | { ok: true; student: Student; message: string }
  | { ok: false; message: string };

export type CreateStudentResult = UpdateStudentResult;
export type DeleteStudentResult = { ok: boolean; message: string; id?: string };
