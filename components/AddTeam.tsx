"use client";

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface AddTeamProps {
    disabled?: boolean;
    onClick: () => void;
}

const AddTeam = ({ disabled = false, onClick }: AddTeamProps) => (
    <Button className="h-9" onClick={onClick} disabled={disabled}>
        <Plus className="mr-2 h-4 w-4" />
        Add team
    </Button>
);

export default AddTeam;
