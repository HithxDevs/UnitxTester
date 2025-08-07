import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { LandingPage } from "./components/Landingpage";


export default async function Home() {
  const session = await getServerSession(authOptions);
  
  return (
    <LandingPage session={session} />
  );
}