import {Box,type SxProps,type Theme} from '@mui/material';
import type {ReactNode} from 'react';
import {GENEALOGY_CARD_WIDTH} from './genealogyLayout';
/** Shared compact card geometry; identity-specific adapters choose text and one theme. */
export default function GenealogyCardFrame({children,height,sx,...data}:{children:ReactNode;height?:number;sx?:SxProps<Theme>;[key:string]:unknown}){return <Box {...data} sx={{border:'1px solid',borderColor:'var(--gg-border)',backgroundColor:'var(--gg-panel)',color:'var(--gg-text)',borderRadius:'var(--gg-radius)',boxSizing:'border-box',width:GENEALOGY_CARD_WIDTH,height,px:'8px',py:'6px',textAlign:'center',...sx}}>{children}</Box>;}
