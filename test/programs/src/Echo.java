import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Echo {
    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = in.readLine()) != null) {
            System.out.println("echo: " + line);
        }
        System.out.println("done");
    }
}
