import { Pool } from 'pg';
interface User {
    id: string;
    email: string;
    name: string;
    created_at: string;
}
interface Workspace {
    id: string;
    name: string;
    created_at: string;
    owner_id: string;
    role?: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: User;
            workspace?: Workspace;
            file?: any;
        }
    }
}
declare const pool: Pool;
declare const app: import("express-serve-static-core").Express;
export { app, pool };
//# sourceMappingURL=server.d.ts.map