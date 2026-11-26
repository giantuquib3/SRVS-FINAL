import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { roleLabel, formatShortVersionLabel } from '@/lib/status';
import { listEditRequests } from '@/lib/edit-permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const notifications: any[] = [];

    if (user.role === 'Admin') {
      const pendingUsers = await prisma.user.findMany({
        where: { accountStatus: 'PendingApproval' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, fullName: true, email: true, role: true, departmentId: true, createdAt: true },
      });

      for (const u of pendingUsers) {
        notifications.push({
          id: `reg-${u.id}`,
          title: 'Pending Account Approval',
          message: `${u.fullName} (${u.email}) registered as ${roleLabel(u.role)}.`,
          createdAt: u.createdAt,
          link: '/admin/dashboard',
        });
      }
    } else if (user.role === 'DepartmentHead' && user.departmentId) {
      const deptCode = String(user.departmentId).toUpperCase();
      const [pendingVersions, pendingEditRequests] = await Promise.all([
        prisma.syllabusVersion.findMany({
          where: { syllabus: { departmentId: deptCode }, approvalStatus: 'SUBMITTED' },
          include: {
            editor: { select: { fullName: true } },
            syllabus: { include: { subject: { select: { code: true, title: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        listEditRequests({ departmentId: deptCode, status: 'PENDING' }),
      ]);

      for (const reqItem of pendingEditRequests) {
        notifications.push({
          id: `edit-req-${reqItem.id}`,
          title: `Edit Permission Requested: ${reqItem.syllabus.subject.code}`,
          message: `${reqItem.faculty.fullName} requested permission to edit [${reqItem.syllabus.subject.code}] ${reqItem.syllabus.subject.title}.`,
          createdAt: reqItem.requestedAt,
          link: '/dept/dashboard?tab=edit-requests',
        });
      }

      for (const v of pendingVersions) {
        notifications.push({
          id: `syl-dept-v-${v.id}`,
          title: `Faculty Revision Pending Review: ${v.syllabus.subject.code} (${formatShortVersionLabel(v)})`,
          message: `${v.editor?.fullName || 'Faculty'} submitted changes for [${v.syllabus.subject.code}] ${v.syllabus.subject.title}.`,
          createdAt: v.submittedAt || v.createdAt,
          link: `/department/syllabus-approvals/${v.id}`,
        });
      }
    } else if (user.role === 'Dean') {
      const deptWhere = user.departmentId
        ? { syllabus: { departmentId: String(user.departmentId).toUpperCase() }, approvalStatus: 'UNDER_REVIEW' }
        : { approvalStatus: 'UNDER_REVIEW' };
      const deanPending = await prisma.syllabusVersion.findMany({
        where: deptWhere,
        include: {
          editor: { select: { fullName: true } },
          syllabus: { include: { subject: { select: { code: true, title: true } } } },
        },
        orderBy: { submittedAt: 'desc' },
      });
      for (const v of deanPending) {
        notifications.push({
          id: `syl-dean-v-${v.id}`,
          title: `Dept. Head Submission Awaiting Dean Approval: ${v.syllabus.subject.code} (${formatShortVersionLabel(v)})`,
          message: `Department Head ${v.editor?.fullName || ''} submitted changes for [${v.syllabus.subject.code}] ${v.syllabus.subject.title} for Dean approval.`,
          createdAt: v.submittedAt || v.createdAt,
          link: `/department/syllabus-approvals/${v.id}`,
        });
      }
    } else if (user.role === 'Educator' || user.role === 'Faculty') {
      const currentUserIdInt = parseInt(user.id, 10) || 0;
      const [myEditRequests, recentReviewedVersions] = await Promise.all([
        listEditRequests({ facultyId: currentUserIdInt }),
        prisma.syllabusVersion.findMany({
          where: {
            editorId: currentUserIdInt,
            approvalStatus: { in: ['APPROVED', 'REJECTED'] },
            reviewedAt: { not: null },
          },
          include: {
            reviewedBy: { select: { fullName: true } },
            syllabus: { include: { subject: { select: { code: true, title: true } } } },
          },
          orderBy: { reviewedAt: 'desc' },
          take: 8,
        }),
      ]);

      for (const reqItem of myEditRequests.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED').slice(0, 6)) {
        notifications.push({
          id: `fac-edit-req-${reqItem.id}`,
          title:
            reqItem.status === 'APPROVED'
              ? `Edit Permission Granted: ${reqItem.syllabus.subject.code}`
              : `Edit Permission Denied: ${reqItem.syllabus.subject.code}`,
          message:
            reqItem.status === 'APPROVED'
              ? `Your Department Head granted edit access for [${reqItem.syllabus.subject.code}] ${reqItem.syllabus.subject.title}.`
              : `Your edit request for [${reqItem.syllabus.subject.code}] was denied.${reqItem.reviewRemarks ? ` Reason: ${reqItem.reviewRemarks}` : ''}`,
          createdAt: reqItem.reviewedAt || reqItem.updatedAt,
          link: reqItem.status === 'APPROVED' ? `/syllabi/${reqItem.syllabusId}/edit` : `/syllabi/${reqItem.syllabusId}`,
        });
      }

      for (const v of recentReviewedVersions) {
        if (
          v.versionNumber === 1 &&
          (String(v.changeSummary || '').startsWith('Initial syllabus') ||
            String(v.changeSummary || '').startsWith('Auto-generated'))
        ) {
          continue;
        }
        notifications.push({
          id: `fac-ver-${v.id}`,
          title:
            v.approvalStatus === 'APPROVED'
              ? `Syllabus Revision Approved (Version ${v.versionNumber}): ${v.syllabus.subject.code}`
              : `Syllabus Revision Returned: ${v.syllabus.subject.code}`,
          message:
            v.approvalStatus === 'APPROVED'
              ? `${v.reviewedBy?.fullName || 'Department Head'} approved your revision for [${v.syllabus.subject.code}] as Version ${v.versionNumber}.`
              : `${v.reviewedBy?.fullName || 'Department Head'} returned your revision for [${v.syllabus.subject.code}].${v.rejectionReason ? ` Feedback: "${v.rejectionReason}"` : ''}`,
          createdAt: v.reviewedAt || v.updatedAt,
          link: v.approvalStatus === 'APPROVED' ? `/syllabi/${v.syllabusId}` : `/syllabi/${v.syllabusId}/edit?fromVersion=${v.versionNumber}`,
        });
      }
    }

    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ notifications, unreadCount: notifications.length });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
