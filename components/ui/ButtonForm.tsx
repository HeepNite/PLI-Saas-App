import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function ButtonForm() {
    return (
        <Button
            aria-label="Explorar cursos online"
            type="button"
            className="bg-transparent text-foreground hover:bg-[var(--brand)] hover:text-white transition-colors h-9 px-3 inline-flex items-center gap-2 rounded-md"
        >
            <Compass className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide">Explorar cursos online</span>
        </Button>
    );
}
