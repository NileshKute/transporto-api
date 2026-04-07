export type SeedRow = {
  role: string;
  module: string;
  action: string;
  allowed: boolean;
  ownOnly?: boolean;
};

/** Default RBAC matrix — expanded into flat Permission rows by the service. */
export const DEFAULT_PERMISSION_GROUPS: Array<{
  role: string;
  module: string;
  actions: string[];
  ownOnly?: boolean;
}> = [
  { role: 'ADMIN', module: 'vehicles', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'drivers', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'trips', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'fuel', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'maintenance', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'emergencies', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'insurance', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'cold-storage', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'shifts', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'whatsapp', actions: ['view', 'create'] },
  { role: 'ADMIN', module: 'clients', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'invoices', actions: ['view', 'create', 'edit', 'delete', 'download'] },
  {
    role: 'ADMIN',
    module: 'quotations',
    actions: ['view', 'create', 'edit', 'delete', 'download', 'import'],
  },
  {
    role: 'ADMIN',
    module: 'driver-ledger',
    actions: ['view', 'create', 'edit', 'delete', 'mark-paid', 'download'],
  },
  { role: 'ADMIN', module: 'salary', actions: ['view', 'create', 'edit', 'approve', 'pay'] },
  { role: 'ADMIN', module: 'users', actions: ['view', 'create', 'edit', 'delete'] },
  { role: 'ADMIN', module: 'permissions', actions: ['view', 'edit'] },

  { role: 'CEO', module: 'vehicles', actions: ['view'] },
  { role: 'CEO', module: 'drivers', actions: ['view'] },
  { role: 'CEO', module: 'trips', actions: ['view'] },
  { role: 'CEO', module: 'fuel', actions: ['view'] },
  { role: 'CEO', module: 'maintenance', actions: ['view'] },
  { role: 'CEO', module: 'emergencies', actions: ['view'] },
  { role: 'CEO', module: 'insurance', actions: ['view'] },
  { role: 'CEO', module: 'cold-storage', actions: ['view'] },
  { role: 'CEO', module: 'shifts', actions: ['view'] },
  { role: 'CEO', module: 'whatsapp', actions: ['view'] },
  { role: 'CEO', module: 'clients', actions: ['view'] },
  { role: 'CEO', module: 'invoices', actions: ['view', 'download'] },
  { role: 'CEO', module: 'quotations', actions: ['view', 'download'] },
  {
    role: 'CEO',
    module: 'driver-ledger',
    actions: ['view', 'mark-paid', 'download'],
  },
  { role: 'CEO', module: 'salary', actions: ['view', 'approve', 'pay'] },

  { role: 'MANAGER', module: 'vehicles', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'drivers', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'trips', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'fuel', actions: ['view', 'create'] },
  { role: 'MANAGER', module: 'maintenance', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'emergencies', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'insurance', actions: ['view'] },
  { role: 'MANAGER', module: 'cold-storage', actions: ['view'] },
  { role: 'MANAGER', module: 'shifts', actions: ['view', 'create', 'edit'] },
  { role: 'MANAGER', module: 'whatsapp', actions: ['view', 'create'] },
  { role: 'MANAGER', module: 'driver-ledger', actions: ['view', 'create', 'edit', 'download'] },
  { role: 'MANAGER', module: 'salary', actions: ['view', 'create'] },
  {
    role: 'MANAGER',
    module: 'quotations',
    actions: ['view', 'create', 'edit', 'download'],
  },

  { role: 'ACCOUNTANT', module: 'clients', actions: ['view', 'create', 'edit'] },
  {
    role: 'ACCOUNTANT',
    module: 'invoices',
    actions: ['view', 'create', 'edit', 'delete', 'download'],
  },
  {
    role: 'ACCOUNTANT',
    module: 'quotations',
    actions: ['view', 'create', 'edit', 'delete', 'download', 'import'],
  },
  {
    role: 'ACCOUNTANT',
    module: 'driver-ledger',
    actions: ['view', 'create', 'edit', 'mark-paid', 'download'],
  },
  { role: 'ACCOUNTANT', module: 'salary', actions: ['view', 'create', 'pay'] },
  { role: 'ACCOUNTANT', module: 'fuel', actions: ['view'] },

  { role: 'DRIVER', module: 'driver-ledger', actions: ['view', 'download'], ownOnly: true },
  { role: 'DRIVER', module: 'salary', actions: ['view'], ownOnly: true },
  { role: 'DRIVER', module: 'trips', actions: ['view'], ownOnly: true },

  // VIEWER — read-only (legacy role)
  { role: 'VIEWER', module: 'vehicles', actions: ['view'] },
  { role: 'VIEWER', module: 'drivers', actions: ['view'] },
  { role: 'VIEWER', module: 'trips', actions: ['view'] },
  { role: 'VIEWER', module: 'fuel', actions: ['view'] },
  { role: 'VIEWER', module: 'maintenance', actions: ['view'] },
  { role: 'VIEWER', module: 'emergencies', actions: ['view'] },
  { role: 'VIEWER', module: 'insurance', actions: ['view'] },
  { role: 'VIEWER', module: 'cold-storage', actions: ['view'] },
  { role: 'VIEWER', module: 'shifts', actions: ['view'] },
  { role: 'VIEWER', module: 'whatsapp', actions: ['view'] },
  { role: 'VIEWER', module: 'clients', actions: ['view'] },
  { role: 'VIEWER', module: 'invoices', actions: ['view', 'download'] },
  { role: 'VIEWER', module: 'quotations', actions: ['view', 'download'] },
  { role: 'VIEWER', module: 'driver-ledger', actions: ['view', 'download'] },
  { role: 'VIEWER', module: 'salary', actions: ['view'] },

  // COLD_STORAGE_OPERATOR
  { role: 'COLD_STORAGE_OPERATOR', module: 'cold-storage', actions: ['view', 'create', 'edit'] },
  { role: 'COLD_STORAGE_OPERATOR', module: 'vehicles', actions: ['view'] },
];

export function flattenDefaultPermissions(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const g of DEFAULT_PERMISSION_GROUPS) {
    for (const action of g.actions) {
      rows.push({
        role: g.role,
        module: g.module,
        action,
        allowed: true,
        ownOnly: g.ownOnly ?? false,
      });
    }
  }
  return rows;
}
