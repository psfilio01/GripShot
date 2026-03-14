import { z } from "zod";
declare const EnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    WORKFLOW_DATA_ROOT: z.ZodDefault<z.ZodString>;
    NANOBANANA_API_KEY: z.ZodOptional<z.ZodString>;
    NANOBANANA_BASE_URL: z.ZodDefault<z.ZodString>;
    NANOBANANA_MODEL: z.ZodDefault<z.ZodString>;
    /** When "true", skip the real API call and use the reference image as output (for local testing when API is unreachable). */
    NANOBANANA_DRY_RUN: z.ZodEffects<z.ZodOptional<z.ZodString>, boolean, string | undefined>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    WORKFLOW_DATA_ROOT: string;
    NANOBANANA_BASE_URL: string;
    NANOBANANA_MODEL: string;
    NANOBANANA_DRY_RUN: boolean;
    NANOBANANA_API_KEY?: string | undefined;
}, {
    NODE_ENV?: "development" | "test" | "production" | undefined;
    WORKFLOW_DATA_ROOT?: string | undefined;
    NANOBANANA_API_KEY?: string | undefined;
    NANOBANANA_BASE_URL?: string | undefined;
    NANOBANANA_MODEL?: string | undefined;
    NANOBANANA_DRY_RUN?: string | undefined;
}>;
export type Env = z.infer<typeof EnvSchema>;
export declare function getEnv(): Env;
export {};
//# sourceMappingURL=env.d.ts.map