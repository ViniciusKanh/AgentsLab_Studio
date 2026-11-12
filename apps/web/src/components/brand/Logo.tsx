import { asset } from '@/lib/assets'
import { cx } from '../ui/primitives'

/** Logotipo oficial (recortado de tools/branding/source/agentslab-logo-original.png). */
export function LogoHorizontal({ height = 64, className }: { height?: number; className?: string }) {
  return <img src={asset('branding/logo-horizontal.png')} alt="AgentsLab Studio" style={{ height }} className={cx('w-auto select-none drop-shadow-[0_0_14px_rgba(157,98,255,0.45)]', className)} draggable={false} />
}

export function LogoEmblem({ size = 40, className }: { size?: number; className?: string }) {
  return <img src={asset('branding/logo-emblem.png')} alt="AgentsLab Studio" width={size} height={size} className={cx('select-none', className)} draggable={false} />
}
