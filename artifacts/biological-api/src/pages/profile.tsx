import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/react";
import { useGetCurrentUser, useUpdateCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Save, Zap, Settings, Mail } from "lucide-react";
import { motion } from "framer-motion";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  chronotype: z.string().min(1, "Chronotype is required"),
  primaryGoal: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const TIER_COLORS: Record<string, string> = {
  basic: "border-muted text-muted-foreground",
  optimize: "border-primary/50 text-primary",
  elite: "border-yellow-400/50 text-yellow-400",
};

export default function Profile() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetCurrentUser();
  const updateProfile = useUpdateCurrentUser();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { openUserProfile } = useClerk();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      chronotype: "intermediate",
      primaryGoal: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        chronotype: user.chronotype || "intermediate",
        primaryGoal: user.primaryGoal || "",
      });
    }
  }, [user, form]);

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate({ data }, {
      onSuccess: () => {
        toast.success("Profile updated successfully");
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update profile");
      },
    });
  };

  // Identity surfaced from Clerk (the source of truth for who the operator is).
  const displayName =
    clerkUser?.fullName || clerkUser?.username || user?.name || "Operator";
  const displayEmail =
    clerkUser?.primaryEmailAddress?.emailAddress || user?.email || "";
  const initials = (displayName || "OP")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const verified =
    clerkUser?.primaryEmailAddress?.verification?.status === "verified";

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-8"
      >
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <Avatar className="w-16 h-16 border border-primary/30 shrink-0">
            {clerkUser?.imageUrl && <AvatarImage src={clerkUser.imageUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary font-mono text-xl">
              {clerkLoaded ? initials : "··"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-mono font-bold uppercase tracking-wider truncate" data-testid="profile-name">
                {displayName}
              </h1>
              {user?.tier && (
                <Badge
                  variant="outline"
                  className={`font-mono uppercase text-xs ${TIER_COLORS[user.tier.toLowerCase()] || "border-primary/30 text-primary"}`}
                >
                  {user.tier} tier
                </Badge>
              )}
              {user?.role && user.role !== "user" && (
                <Badge variant="outline" className="font-mono uppercase text-xs border-yellow-400/40 text-yellow-400">
                  {user.role}
                </Badge>
              )}
            </div>
            <p
              className="text-muted-foreground font-mono text-sm mt-1 truncate flex items-center gap-2"
              data-testid="profile-email"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {displayEmail || "Loading..."}
              {clerkLoaded && displayEmail && (
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded shrink-0 ${
                    verified
                      ? "border-primary/40 text-primary"
                      : "border-yellow-400/40 text-yellow-400"
                  }`}
                >
                  {verified ? "Verified" : "Unverified"}
                </span>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openUserProfile()}
            className="font-mono uppercase tracking-wider shrink-0 hidden sm:inline-flex"
            data-testid="btn-manage-account"
          >
            <Settings className="w-3.5 h-3.5 mr-2" /> Manage account
          </Button>
        </div>

        <div className="sm:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openUserProfile()}
            className="font-mono uppercase tracking-wider w-full"
            data-testid="btn-manage-account-mobile"
          >
            <Settings className="w-3.5 h-3.5 mr-2" /> Manage account, security & sessions
          </Button>
        </div>

        {user?.tier?.toLowerCase() !== "elite" && !isLoading && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono font-bold text-sm uppercase tracking-wider text-primary">Upgrade Your Plan</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {user?.tier?.toLowerCase() === "basic"
                  ? "Unlock advanced AI insights and unlimited integrations with Optimize or Elite."
                  : "Unlock elite-level AI coaching and priority support with the Elite tier."}
              </p>
            </div>
            <Button size="sm" className="font-mono uppercase tracking-wider shrink-0" data-testid="btn-upgrade">
              <Zap className="w-3 h-3 mr-2" />
              Upgrade
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Display Name</FormLabel>
                    <FormControl>
                      <Input className="font-mono bg-card" placeholder="Enter your name" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chronotype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Chronotype</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="font-mono bg-card" data-testid="select-chronotype">
                          <SelectValue placeholder="Select chronotype" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="early_bird">Early Bird (Lion) — peaks before noon</SelectItem>
                        <SelectItem value="intermediate">Intermediate (Bear) — peaks mid-day</SelectItem>
                        <SelectItem value="night_owl">Night Owl (Wolf) — peaks after 8pm</SelectItem>
                        <SelectItem value="dolphin">Dolphin — light sleeper, irregular</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryGoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Primary Mission Objective</FormLabel>
                    <FormControl>
                      <Textarea
                        className="font-mono bg-card resize-none h-32"
                        placeholder="e.g. increase deep sleep, stabilize glucose, improve HRV baseline"
                        {...field}
                        data-testid="input-goals"
                      />
                    </FormControl>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="font-mono uppercase tracking-wider"
                  data-testid="button-save-profile"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfile.isPending ? "Updating..." : "Save Configuration"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </motion.div>
    </Layout>
  );
}
