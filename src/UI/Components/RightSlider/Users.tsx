import { Typography } from "@mui/material";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import { colorToString } from "../../../paid/theme";
import { RootState } from "../../../store";
import formatNumber from "../../../utils/formatNumber";

const UserCard = ({
  name,
  face,
  score,
  borderColor,
  borderImage,
}: {
  name: string;
  face?: string;
  score: number | string;
  borderColor?: string;
  borderImage?: string;
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        fontSize: "2rem",
        p: 1,
      }}
    >
      <Box
        sx={{
          width: "4rem",
          height: "4rem",
          mr: 1,
          boxSizing: "border-box",
          border: `.2em solid ${borderColor}`,
          borderImage: `${borderImage} 1`,
        }}
      >
        <img
          style={{
            width: "100%",
            height: "100%",
          }}
          src={face}
          alt=""
        />
      </Box>
      <Box
        sx={{
          fontWeight: "bolder",
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          sx={{
            flex: 1,
            width: 0,
          }}
          noWrap
          fontSize="2rem"
        >
          {name}
        </Typography>
        <Box
          sx={{
            color: "#eaeb5c",
            textShadow: "2px 2px black",
          }}
        >
          {typeof score === "string" ? score : formatNumber(score)}
        </Box>
      </Box>
    </Box>
  );
};

export default function Users() {
  const users = useSelector((state: RootState) =>
    state.root.teams
      .map((team) => [...team.users])
      .flat()
      .sort((a, b) => b.score - a.score)
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          height: 0,
        }}
      >
        {users.map((user) => {
          return (
            <UserCard
              score={user.score}
              key={user.id}
              name={user.name}
              face={user.face}
              borderColor={colorToString(user.team.color)}
              borderImage={`url(${user.team.tile})`}
            />
          );
        })}
      </Box>
    </Box>
  );
}
