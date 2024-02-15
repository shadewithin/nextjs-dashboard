'use server';
import {z} from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

//Auth Actions

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {

    try 
    {
        await signIn('credentials', formData);
    }
    catch (e) 
    {
        if (e instanceof AuthError) {
            switch (e.type) {
              case 'CredentialsSignin':
                return 'Invalid credentials.';
              default:
                return 'Something went wrong.';
            }
        }
        throw e;
    }


  }






//Dashboard and Invoice Actions

//Defining the schema that our database is expecting when creating a new Invoice

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
      }),
    amount: z.coerce.number()
    .gt(0, { message: 'Please enter an amount greater than $0.00' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
      }),
    date: z.string(),
  });
   
  const CreateInvoice = FormSchema.omit({ id: true, date: true });
  const UpdateInvoice = FormSchema.omit({ id: true, date: true });

//Create Invoice actions

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

export async function createInvoice (prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    
    if(!validatedFields.success)
    {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        }
    }

    const { customerId, amount, status } = validatedFields.data;
    //Best practice to store amounts in cents to avoid any rounding errors.
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    
    
try {
    //Add the new invoice record to our database
    await sql`INSERT INTO invoices (customer_id, amount, status, date)
              VALUES (${customerId}, ${amountInCents}, ${status}, ${date});`;
}
catch (e) {
    console.log(e);
    return {
        message: 'Database Error: Failed to Create Invoice.',
      };
}

//Revalidate path to ensure the cache is updated and the new data/ invoice is reflected after being entered.
revalidatePath('/dashboard/invoices');
//Redirect from the create page back to the invoices dashboard.
redirect('/dashboard/invoices');
}


//Update Invoice

export async function updateInvoice (id: string, prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    
    if(!validatedFields.success)
    {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        }
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    
try {
    //Update the matching invoice record in our database
    await sql`UPDATE invoices 
              SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
              WHERE id = ${id};`;
}
catch (e) {
    console.log(e);
    return {
        message: 'Database Error: Failed to Update Invoice.',
      };
}

    //Revalidate path to update the dash view
    revalidatePath('/dashboard/invoices');
    //Redirect from the Edit page back to the invoices dashboard.
    redirect('/dashboard/invoices');
}

//Delete Invoice

export async function deleteInvoice (id: string) {
    try{
        await sql`DELETE FROM invoices WHERE id = ${id};`;
        //Revalidate the data cache, no need to redirect or manually refresh the page, as this reval will trigger a refresh
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    }
    catch (e) {
        console.log(e);
        return {
            message: 'Database Error: Failed to Delete Invoice.',
          };
    }
    
}

