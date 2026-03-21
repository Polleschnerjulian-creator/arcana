"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddBankAccountDialog } from "./add-bank-account-dialog";

interface AccountOption {
  id: string;
  number: string;
  name: string;
}

export function AddBankAccountButton({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Bankkonto hinzufügen
      </Button>
      {open && (
        <AddBankAccountDialog
          accounts={accounts}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
