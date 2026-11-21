import { CaseEntity } from './entities/case.entity';
import { CaseHandoff } from './entities/case-handoff.entity';
import { CaseNote } from './entities/case-note.entity';

export function mapCase(c: CaseEntity) {
  return {
    id: String(c.id),
    caseNo: c.caseNo,
    status: c.status,
    priority: c.priority,
    slaBand: c.slaBand,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    sourceClientId: c.sourceClientId,
    sourceUnitsaleId: c.sourceUnitsaleId,
    sourceUnitId: c.sourceUnitId,
    sourceReceiptId: c.sourceReceiptId,
    category: c.category
      ? {
          id: String(c.category.id),
          name: c.category.name,
        }
      : null,
    department: c.department
      ? {
          id: String(c.department.id),
          code: c.department.code,
          name: c.department.name,
        }
      : null,
    assignee: c.assignee
      ? {
          id: String(c.assignee.id),
          name: c.assignee.name,
          email: c.assignee.email,
        }
      : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function mapCaseDetail(c: CaseEntity) {
  return {
    ...mapCase(c),
    notes: (c.notes ?? []).map(mapNote),
    handoffs: (c.handoffs ?? []).map(mapHandoff),
  };
}

export function mapNote(n: CaseNote) {
  return {
    id: String(n.id),
    body: n.body,
    clientVisible: Boolean(n.clientVisible),
    createdAt: n.createdAt,
    user: n.user
      ? { id: String(n.user.id), name: n.user.name, email: n.user.email }
      : null,
  };
}

export function mapHandoff(h: CaseHandoff) {
  return {
    id: String(h.id),
    note: h.note,
    createdAt: h.createdAt,
    fromDepartment: {
      id: String(h.fromDepartment.id),
      code: h.fromDepartment.code,
      name: h.fromDepartment.name,
    },
    toDepartment: {
      id: String(h.toDepartment.id),
      code: h.toDepartment.code,
      name: h.toDepartment.name,
    },
    byUser: h.byUser
      ? {
          id: String(h.byUser.id),
          name: h.byUser.name,
          email: h.byUser.email,
        }
      : null,
  };
}
