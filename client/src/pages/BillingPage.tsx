import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CreditCard, Check, Zap, Building2, Users, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  maxUsers: number;
  maxQueriesPerMonth: number;
  maxRowsDisplay: number;
  maxRowsExport: number;
  features: string[];
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
}

interface OrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  stripeCustomerId?: string;
  memberRole: string;
}

interface SubscriptionData {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations, isLoading: orgsLoading } = useQuery<OrganizationWithRole[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-plans'],
  });

  const currentOrgId = selectedOrgId || organizations?.[0]?.id;

  const { data: subscriptionData, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ['/api/organizations', currentOrgId, 'subscription'],
    enabled: !!currentOrgId,
  });

  const { data: orgDetails, isLoading: orgDetailsLoading } = useQuery<OrganizationWithRole>({
    queryKey: ['/api/organizations', currentOrgId],
    enabled: !!currentOrgId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, organizationId }: { priceId: string; organizationId: string }) => {
      const response = await apiRequest("POST", "/api/stripe/checkout", { priceId, organizationId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      const message = error.message || "Failed to create checkout session";
      if (message.includes("Admin") || message.includes("403")) {
        toast({
          title: "Permission denied",
          description: "Only organization admins can manage billing",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Checkout failed",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  const portalMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await apiRequest("POST", "/api/stripe/portal", { organizationId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      const message = error.message || "Failed to open billing portal";
      if (message.includes("Admin") || message.includes("403")) {
        toast({
          title: "Permission denied",
          description: "Only organization admins can manage billing",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Portal error",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  if (orgsLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  const currentOrg = organizations.find(o => o.id === currentOrgId) || organizations[0];
  const isAdmin = currentOrg?.memberRole === 'admin';
  const currentPlan = subscriptionData?.plan || plans?.find(p => p.id === subscriptionData?.subscription?.planId);

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatLimit = (value: number) => {
    if (value === -1) return "Unlimited";
    return value.toLocaleString();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-billing-title">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and billing settings</p>
        </div>
        {organizations.length > 1 && (
          <Select value={currentOrgId || undefined} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[250px]" data-testid="select-organization">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!isAdmin && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>View Only</AlertTitle>
          <AlertDescription>
            Only organization admins can modify billing settings. Contact your admin to make changes.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {currentOrg?.name}
          </CardTitle>
          <CardDescription>
            Your current subscription details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Loading subscription...</span>
            </div>
          ) : currentPlan ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{currentPlan.name}</span>
                  <Badge variant={subscriptionData?.subscription?.status === 'active' ? 'default' : 'secondary'}>
                    {subscriptionData?.subscription?.status || 'active'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{currentPlan.description}</p>
                {subscriptionData?.subscription?.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next billing: {new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatPrice(currentPlan.priceMonthly)}
                  {currentPlan.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground">/month</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active subscription. Choose a plan below to get started.</p>
          )}

          {isAdmin && currentOrg?.stripeCustomerId && (
            <Button 
              variant="outline" 
              onClick={() => portalMutation.mutate(currentOrg.id)}
              disabled={portalMutation.isPending}
              data-testid="button-manage-billing"
            >
              {portalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans?.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const hasValidStripePrice = !!plan.stripePriceIdMonthly;
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isCurrentPlan ? 'border-primary' : ''}`}
                data-testid={`card-plan-${plan.slug}`}
              >
                {isCurrentPlan && (
                  <Badge className="absolute -top-2 left-4">Current Plan</Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {plan.slug === 'enterprise' && <Zap className="h-5 w-5 text-yellow-500" />}
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">{formatPrice(plan.priceMonthly)}</span>
                    {plan.priceMonthly > 0 && <span className="text-muted-foreground">/month</span>}
                  </div>

                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {formatLimit(plan.maxUsers)} users
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {formatLimit(plan.maxQueriesPerMonth)} queries/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {formatLimit(plan.maxRowsDisplay)} rows display
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {formatLimit(plan.maxRowsExport)} rows export
                    </li>
                  </ul>

                  <div className="pt-2">
                    {isCurrentPlan ? (
                      <Button variant="outline" disabled className="w-full">
                        Current Plan
                      </Button>
                    ) : plan.priceMonthly === 0 ? (
                      <Button variant="outline" disabled className="w-full">
                        Free Tier
                      </Button>
                    ) : !isAdmin ? (
                      <Button variant="outline" disabled className="w-full">
                        Contact Admin to Upgrade
                      </Button>
                    ) : !hasValidStripePrice ? (
                      <Button variant="outline" disabled className="w-full">
                        Contact Sales
                      </Button>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedPlan(plan.id);
                          checkoutMutation.mutate({ 
                            priceId: plan.stripePriceIdMonthly!, 
                            organizationId: currentOrg.id 
                          });
                        }}
                        disabled={checkoutMutation.isPending && selectedPlan === plan.id}
                        data-testid={`button-upgrade-${plan.slug}`}
                      >
                        {checkoutMutation.isPending && selectedPlan === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Upgrade to {plan.name}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
