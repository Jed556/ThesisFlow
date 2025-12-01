import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import {
    DEFAULT_YEAR,
    DEFAULT_DEPARTMENT_SEGMENT,
    DEFAULT_COURSE_SEGMENT,
    YEAR_ROOT,
    DEPARTMENTS_SUBCOLLECTION,
    COURSES_SUBCOLLECTION,
} from '../../../config/firestore';
import { buildDepartmentPath, buildCoursePath, sanitizePathSegment } from './paths';

export interface CourseTemplateContextInput {
    year?: string;
    department: string;
    course: string;
}

export interface NormalizedCourseTemplateContext {
    year: string;
    department: string;
    departmentKey: string;
    course: string;
    courseKey: string;
}

export function normalizeCourseTemplateContext(
    params: CourseTemplateContextInput
): NormalizedCourseTemplateContext {
    const year = params.year?.trim() || DEFAULT_YEAR;
    const department = params.department.trim();
    const course = params.course.trim();
    const departmentKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
    return { year, department, departmentKey, course, courseKey };
}

export async function ensureCourseHierarchyExists(
    context: NormalizedCourseTemplateContext,
    timestamp: string
): Promise<void> {
    const departmentRef = doc(firebaseFirestore, buildDepartmentPath(context.year, context.department));
    const departmentSnap = await getDoc(departmentRef);
    if (!departmentSnap.exists()) {
        await setDoc(departmentRef, {
            name: context.department,
            createdAt: timestamp,
            updatedAt: timestamp,
        }, { merge: true });
    }

    const courseRef = doc(firebaseFirestore, buildCoursePath(context.year, context.department, context.course));
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists()) {
        await setDoc(courseRef, {
            name: context.course,
            department: context.department,
            createdAt: timestamp,
            updatedAt: timestamp,
        }, { merge: true });
    }
}

/**
 * List all departments for a given academic year
 * Reads from year/{year}/departments subcollection
 */
export async function listDepartmentsForYear(year: string = DEFAULT_YEAR): Promise<string[]> {
    const departmentsPath = `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}`;
    const departmentsRef = collection(firebaseFirestore, departmentsPath);
    const snapshot = await getDocs(departmentsRef);
    return snapshot.docs
        .map((docSnap) => {
            const data = docSnap.data();
            return (data.name as string) ?? docSnap.id;
        })
        .filter((dept): dept is string => Boolean(dept))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * List all courses for a given department and year
 * Reads from year/{year}/departments/{department}/courses subcollection
 */
export async function listCoursesForDepartment(
    year: string = DEFAULT_YEAR,
    department: string,
): Promise<string[]> {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const coursesPath = `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}/${COURSES_SUBCOLLECTION}`;
    const coursesRef = collection(firebaseFirestore, coursesPath);
    const snapshot = await getDocs(coursesRef);
    return snapshot.docs
        .map((docSnap) => {
            const data = docSnap.data();
            return (data.name as string) ?? docSnap.id;
        })
        .filter((course): course is string => Boolean(course))
        .sort((a, b) => a.localeCompare(b));
}
