import { PrismaClient } from "@prisma/client";

const globalDb = globalThis as unknown as { prismaBase?: PrismaClient; prisma?: any };
export const prismaBase = globalDb.prismaBase ?? new PrismaClient({ 
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  datasources: { db: { url: process.env.DATABASE_URL } }
});
if (process.env.NODE_ENV !== "production") globalDb.prismaBase = prismaBase;

export const prisma = globalDb.prisma ?? prismaBase.$extends({
  result: {
    product: {
      sizes: { needs: { sizes: true }, compute(p) { try { return p.sizes ? JSON.parse(p.sizes as any as string) : []; } catch { return []; } } },
      colors: { needs: { colors: true }, compute(p) { try { return p.colors ? JSON.parse(p.colors as any as string) : []; } catch { return []; } } },
      tags: { needs: { tags: true }, compute(p) { try { return p.tags ? JSON.parse(p.tags as any as string) : []; } catch { return []; } } }
    },
    order: {
      shippingAddressSnapshot: { needs: { shippingAddressSnapshot: true }, compute(o) { try { return o.shippingAddressSnapshot ? JSON.parse(o.shippingAddressSnapshot as string) : {}; } catch { return {}; } } }
    },
    returnRequest: {
      evidence: { needs: { evidence: true }, compute(r) { try { return r.evidence ? JSON.parse(r.evidence as any as string) : []; } catch { return []; } } }
    },
    storeSettings: {
      socialProfiles: { needs: { socialProfiles: true }, compute(s) { try { return s.socialProfiles ? JSON.parse(s.socialProfiles as string) : {}; } catch { return {}; } } }
    },
    adminAuditLog: {
      metadata: { needs: { metadata: true }, compute(l) { try { return l.metadata ? JSON.parse(l.metadata as string) : {}; } catch { return {}; } } }
    }
  },
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const fields = ['sizes', 'colors', 'tags', 'evidence', 'shippingAddressSnapshot', 'socialProfiles', 'metadata'];
        const stringify = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          for (const key of Object.keys(obj)) {
            if (fields.includes(key) && typeof obj[key] === 'object') obj[key] = JSON.stringify(obj[key]);
            else if (typeof obj[key] === 'object') stringify(obj[key]);
          }
        };
        if ((args as any).data) stringify((args as any).data);
        if ((args as any).update) stringify((args as any).update);
        if ((args as any).create) stringify((args as any).create);
        return query(args);
      }
    }
  }
});
if (process.env.NODE_ENV !== "production") globalDb.prisma = prisma;
