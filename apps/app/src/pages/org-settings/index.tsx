import { useState } from "react";
import { OrganizationProfile } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function OrgGeneralSettingsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Manage your organization's profile, members, and settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsOpen(true)}>
            Manage Organization Settings
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-auto p-0 bg-transparent border-none max-w-none md:max-w-none flex items-center justify-center">
          <OrganizationProfile
            appearance={{
              elements: {
                card: "shadow-none",
              },
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
