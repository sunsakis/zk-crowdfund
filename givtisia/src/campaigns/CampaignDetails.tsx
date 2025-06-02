import NavBar from "@/components/shared/NavBar";
import { useParams } from "react-router";

const CampaignDetails = () => {
  const { id } = useParams();
  return (
    <div>
      <NavBar />
      <div className="container mx-auto max-w-[1500px]">
        <h1>Campaign Details {id}</h1>
      </div>
    </div>
  );
};

export default CampaignDetails;
