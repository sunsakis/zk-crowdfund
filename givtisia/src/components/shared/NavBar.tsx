import { NavLink } from "react-router";
import ConnectButton from "@/components/shared/ConnectButton";
import { HandMetal } from "lucide-react";

const NavBar = () => {
  return (
    <nav className="flex justify-between items-center p-4">
      <NavLink to="/" className="flex items-center space-x-1">
        <HandMetal className="w-6 h-6" />
        <p className="text-2xl font-medium tracking-[-0.075rem]">givtisia</p>
      </NavLink>
      <ConnectButton />
    </nav>
  );
};

export default NavBar;
