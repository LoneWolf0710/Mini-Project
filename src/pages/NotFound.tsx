import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <div className="font-mono text-6xl font-bold gradient-text">404</div>
        <p className="mt-4 text-muted-foreground">Off the grid. That route doesn't exist.</p>
        <Link to="/"><Button className="mt-6">Back to base</Button></Link>
      </div>
    </div>
  );
}
