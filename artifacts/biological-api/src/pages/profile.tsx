import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, useUpdateCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User as UserIcon, Save } from "lucide-react";
import { motion } from "framer-motion";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  timezone: z.string().min(2, "Timezone is required"),
  primaryGoal: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetCurrentUser();
  const updateProfile = useUpdateCurrentUser();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      timezone: "",
      primaryGoal: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        timezone: (user as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
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
      }
    });
  };

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-8"
      >
        <div className="flex items-center gap-3 border-b border-border pb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-mono font-bold uppercase tracking-wider">Operator Profile</h1>
            <p className="text-muted-foreground font-mono text-sm">{user?.email || 'Loading...'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
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
                    <FormLabel className="font-mono uppercase text-xs">Operator Name</FormLabel>
                    <FormControl>
                      <Input className="font-mono bg-card" placeholder="Enter your name" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">System Timezone</FormLabel>
                    <FormControl>
                      <Input className="font-mono bg-card" placeholder="e.g. America/Los_Angeles" {...field} data-testid="input-timezone" />
                    </FormControl>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryGoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase text-xs">Primary Mission Objective (Goals)</FormLabel>
                    <FormControl>
                      <Textarea 
                        className="font-mono bg-card resize-none h-32" 
                        placeholder="Describe what you want to achieve (e.g. increase deep sleep, stabilize glucose)" 
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
